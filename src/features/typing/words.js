// ~200 everyday English words for the typing test. Short and common on purpose.
export const WORDS = `
about across again all along always and animal answer around away bad bank because bed before behind
below better big black boat book box bring build buy came car carry change class clear cold come
could course dark deep different does done down dream drive each earth eat enough every face fall
far feel field fine first five foot form four friend from full garden get give go good green grow
half happy has have he hear help here hill his home horse hour how if in into it just kind land last
laugh leave let life like list little long lot low make many mark mean mind miss moon morning mother
much must near never next no not now of often on one open order our over page part picture plan play
power put quick rain ready red rest river rock round said saw school second seem set ship should
side since sit sleep small so song sound space spring star stay still story strong such sun table
talk tell that the their then these they thing this though through time to together too top town
true turn under up us very voice walk want was water we well were what when where while who why will
window with woman word work world write yellow yet you young your
`
  .trim()
  .split(/\s+/);

/** Random word list; avoids the same word twice in a row. */
export function randomWords(count, rand = Math.random) {
  const out = [];
  while (out.length < count) {
    const word = WORDS[Math.floor(rand() * WORDS.length)];
    if (word !== out[out.length - 1]) out.push(word);
  }
  return out;
}
