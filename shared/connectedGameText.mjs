// Connected-profile text only. Provider markup is never rendered as HTML.
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', middot: '·', bull: '•' };
export function connectedGameText(value, limit = 20_000) {
  if (typeof value !== 'string') return '';
  return value.slice(0, 40_000)
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? match;
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    })
    .replace(/<\s*br\s*\/?\s*>|<\s*\/\s*p\s*>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    // HoYo uses these tokens around ordinary, readable skill names.
    .replace(/\{(?:LINK(?:#[^{}]*)?|\/LINK)\}/gi, '')
    .replace(/\\r\\n|\\n|\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim().slice(0, limit);
}
