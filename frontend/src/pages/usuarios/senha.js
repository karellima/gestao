// Alfabeto sem caracteres que se confundem na leitura em voz alta ou impressos:
// sem l/I/1, sem o/O/0. A senha inicial costuma ser ditada para o usuário.
const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TAMANHO = 12;

function randPass() {
  const sorteios = new Uint32Array(TAMANHO);
  crypto.getRandomValues(sorteios);
  return Array.from(sorteios, n => ALFABETO[n % ALFABETO.length]).join('');
}

export { randPass, ALFABETO, TAMANHO };
