/**
 * Удаляет HTML-теги из строки (для краткого превью в карточках).
 */
export function stripHtml(html) {
  if (html == null || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, '').trim();
}
