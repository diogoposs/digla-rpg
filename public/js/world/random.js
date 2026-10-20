// Sorteio determinístico: a mesma coordenada sempre produz o mesmo detalhe.
// Isso mantém o cenário fixo sem precisar salvar milhares de tiles no banco.
export function hash(x, y, seed = 0) {
  let n =
    Math.imul(x + 71, 374761393) ^ Math.imul(y + 137, 668265263) ^ Math.imul(seed + 3, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
