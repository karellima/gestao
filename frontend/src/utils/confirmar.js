// Mantém a confirmação síncrona existente enquanto as mensagens de erro usam
// o sistema de notificações. O ponto único deixa o no-alert isolado e explícito.
export function confirmar(mensagem) {
  // eslint-disable-next-line no-alert
  return window.confirm(mensagem);
}
