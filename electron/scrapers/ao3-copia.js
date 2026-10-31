async function deLaCopiaDeFicHub(workId, onProgress, problemas) {
  const workUrl = `https://archiveofourown.org/works/${workId}`;
  try {
    const { meta, ...obra } = await require('./fichub.js').copiaDeAO3(workUrl, onProgress);

    const sobran = Math.max(0, obra.chapters.length - (Number(meta.chapters) || obra.chapters.length));
    obra.chapters = obra.chapters.slice(sobran);
    obra.chapterContents = obra.chapterContents.slice(sobran);
    return {
      title: obra.title, author: obra.author, synopsis: obra.synopsis, url: workUrl,
      autorUrl: meta.authorUrl ? `https://archiveofourown.org${meta.authorUrl}` : '',
      wordCount: Number(meta.words) || 0,
      completa: meta.status === 'complete' ? true : (meta.status === 'ongoing' ? false : undefined),
      chapters: obra.chapters.map((c, i) => ({ title: c.title || `Capítulo ${i + 1}`, url: workUrl })),
      chapterContents: obra.chapterContents,
      deCopia: 'FicHub'
    };
  } catch (err) {
    problemas.push(`copia de FicHub: ${err.message}`);
    return null;
  }
}

module.exports = { deLaCopiaDeFicHub };
