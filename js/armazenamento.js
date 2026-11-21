// Armazenamento simples em JSON. Usa localStorage; se estiver indisponível
// (modo privado, bloqueado, cheio), cai para memória e o jogo continua.

const memoria = new Map();

/** Lê um valor JSON. Devolve `padrao` se não existir ou se houver erro. */
export function ler(chave, padrao = null) {
  try {
    const texto = window.localStorage.getItem(chave);
    if (texto == null) return padrao;
    return JSON.parse(texto);
  } catch (e) {
    return memoria.has(chave) ? memoria.get(chave) : padrao;
  }
}

/** Grava um valor JSON. Devolve true se foi para o localStorage. */
export function gravar(chave, valor) {
  memoria.set(chave, valor);
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch (e) {
    return false;
  }
}

/** Remove uma chave (localStorage e memória). */
export function remover(chave) {
  memoria.delete(chave);
  try {
    window.localStorage.removeItem(chave);
  } catch (e) {
    /* sem armazenamento: nada a fazer */
  }
}
