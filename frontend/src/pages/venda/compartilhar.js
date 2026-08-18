const nomeDoArquivo = (id) => `pedido-${id}.pdf`;

const salvarPdf = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export async function compartilharPedido({ id, blob, contactName, onNotice = () => {} }) {
  const filename = nomeDoArquivo(id);
  const file = new File([blob], filename, { type: 'application/pdf' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `Pedido #${id}` });
      return;
    }
    if (navigator.share) {
      await navigator.share({
        title: `Pedido #${id}`,
        text: `Pedido #${id} - ${contactName || ''}`,
        url: window.location.origin + `/sales/${id}/print`,
      });
      return;
    }
  } catch { /* compartilhamento nativo indisponível; salva o PDF */ }

  salvarPdf(blob, filename);
  if (/Mobi|Android|iPhone|iPad|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    setTimeout(() => onNotice('PDF baixado! Compartilhe pelo app de arquivos.'), 500);
  }
}
