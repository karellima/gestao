import api from '../services/api';

export async function baixarModeloDaPlanilha() {
  try {
    const res = await api.get('/products/export-template', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_produtos.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    alert('Erro ao baixar modelo. Tente novamente.');
  }
}
