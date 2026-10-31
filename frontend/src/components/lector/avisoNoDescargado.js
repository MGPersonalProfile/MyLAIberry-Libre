export default function avisoNoDescargado(t) {
  return '<div style="text-align:center; padding:4rem 2rem; opacity:.45;">'
    + '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto .9rem;">'
      + '<path d="M12 3v11"/><path d="m8 11 4 4 4-4"/>'
      + '<path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'
    + '</svg>'
    + `<p style="margin:0; font-size:.95rem;">${t('reader.not_downloaded')}</p>`
    + `<p style="margin:.4rem 0 0; font-size:.85rem; opacity:.7;">${t('reader.downloading_bg')}</p>`
    + '</div>';
}
