/**
 * Redimensiona e comprime uma imagem no navegador antes do upload, via canvas.
 * Evita subir fotos de celular de vários MB quando o produto só precisa de
 * até ~1600px de largura/altura pra ficar nítido no site.
 */
export function compressImage(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas não suportado'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Falha ao comprimir imagem'));
            return;
          }
          const compressedName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          resolve(new File([blob], compressedName, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível carregar a imagem'));
    };

    img.src = objectUrl;
  });
}
