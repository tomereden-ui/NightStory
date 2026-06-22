export function inferCompanionAbility(companion: string): string {
  const c = companion.toLowerCase();
  if (c.includes("dragon"))
    return "can produce precise beams of warm light that reveal hidden things";
  if (c.includes("cat"))
    return "can move in complete silence and fit through impossibly small spaces";
  if (c.includes("dog"))
    return "can track any scent across any distance";
  if (c.includes("fish") || c.includes("coral"))
    return "can communicate with every creature in the water";
  if (c.includes("elephant"))
    return "never forgets anything, even something glimpsed for a single moment";
  if (c.includes("fox") || c.includes("ember"))
    return "can find the one path through any maze, no matter how complicated";
  if (c.includes("cloud") || c.includes("nimbus"))
    return "can change shape to become exactly what is needed";
  if (c.includes("sibling") || c.includes("brother") || c.includes("sister"))
    return "remembers every story the hero has ever told them, and knows exactly when to use one";
  if (c.includes("friend"))
    return "always thinks of the solution the hero would never consider";
  return "has a gift that neither of them fully understands yet — but will, at exactly the right moment";
}
