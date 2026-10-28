-- Rodar uma vez no SQL Editor do Supabase (já incluído no fim do schema.sql).
--
-- Desfaz uma entrada de mercadoria registrada errado (quantidade errada, cor
-- esquecida na distribuição, valor pago errado). Uma entrada de produto com
-- variação grava uma linha de stock_entries por variação, todas na mesma
-- transação — por isso o lote é identificado por (product_id, created_at) e
-- desfeito inteiro: tira as unidades de cada variação (ou do produto simples),
-- recalcula o custo médio sem aquele lote e apaga as linhas do histórico.
-- Recusa se alguma unidade do lote já foi vendida (o estoque ficaria negativo).

create or replace function undo_stock_entry(p_entry_id uuid)
returns void
language plpgsql
as $$
declare
  v_entry stock_entries%rowtype;
  v_row stock_entries%rowtype;
  v_sku product_variant_skus%rowtype;
  v_product products%rowtype;
  v_new_stock integer;
  v_sku_stock integer;
begin
  select * into v_entry from stock_entries where id = p_entry_id;
  if not found then
    raise exception 'Entrada não encontrada (talvez já tenha sido desfeita)';
  end if;

  select * into v_product from products where id = v_entry.product_id for update;
  if not found then
    raise exception 'Produto não encontrado';
  end if;

  for v_row in
    select * from stock_entries
      where product_id = v_entry.product_id and created_at = v_entry.created_at
      for update
  loop
    if v_row.sku_id is not null then
      select * into v_sku from product_variant_skus where id = v_row.sku_id for update;
      v_new_stock := v_sku.stock_quantity - v_row.quantity;
      if v_new_stock < 0 then
        raise exception 'Não dá para desfazer: parte das unidades desta entrada já foi vendida (%).', v_row.quantity - v_sku.stock_quantity;
      end if;

      update product_variant_skus
        set stock_quantity = v_new_stock,
            cost_price = case
              when v_new_stock > 0 then greatest(0, (v_sku.stock_quantity * v_sku.cost_price - v_row.total_cost) / v_new_stock)
              else cost_price
            end
        where id = v_sku.id;
    else
      -- entrada de produto simples; num produto que já tem estoque distribuído
      -- entre variações, o estoque "do produto" é só a soma delas
      select coalesce(sum(stock_quantity), 0) into v_sku_stock
        from product_variant_skus where product_id = v_product.id;
      if v_sku_stock > 0 then
        raise exception 'Esta entrada foi feita antes do produto ter variações e o estoque já foi distribuído entre elas. Não dá para desfazer.';
      end if;

      v_new_stock := v_product.stock_quantity - v_row.quantity;
      if v_new_stock < 0 then
        raise exception 'Não dá para desfazer: parte das unidades desta entrada já foi vendida (%).', v_row.quantity - v_product.stock_quantity;
      end if;

      update products
        set stock_quantity = v_new_stock,
            cost_price = case
              when v_new_stock > 0 then greatest(0, (v_product.stock_quantity * v_product.cost_price - v_row.total_cost) / v_new_stock)
              else cost_price
            end,
            available = v_new_stock > 0
        where id = v_product.id
        returning * into v_product;
    end if;

    delete from stock_entries where id = v_row.id;
  end loop;
end;
$$;

revoke all on function undo_stock_entry(uuid) from public;
grant execute on function undo_stock_entry(uuid) to authenticated;
