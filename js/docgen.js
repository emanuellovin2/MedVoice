const DocGen = (() => {
  const XML_PARTS = [
    'word/document.xml',
    'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
    'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml',
  ];

  // Word splits a placeholder like {{eco_cardio}} across several runs and inserts
  // proofing / tracked-change / bookmark markers between the characters. That leaves
  // the {{ or }} delimiters non-contiguous, so docxtemplater's lexer can't pair them
  // and throws duplicate_open_tag / duplicate_close_tag. We rejoin them here.
  function preprocessXML(xml) {
    // 1. Remove markers that fragment runs.
    xml = xml.replace(/<w:proofErr\b[^>]*\/?>/g, '');
    xml = xml.replace(/<w:noProof\b[^>]*\/?>/g, '');
    xml = xml.replace(/<w:lastRenderedPageBreak\b[^>]*\/?>/g, '');
    xml = xml.replace(/<w:bookmarkStart\b[^>]*\/?>/g, '');
    xml = xml.replace(/<w:bookmarkEnd\b[^>]*\/?>/g, '');
    xml = xml.replace(/<w:ins\b[^>]*>([\s\S]*?)<\/w:ins>/g, '$1');
    xml = xml.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, '');
    xml = xml.replace(/<w:rPrChange\b[^>]*>[\s\S]*?<\/w:rPrChange>/g, '');
    xml = xml.replace(/<w:pPrChange\b[^>]*>[\s\S]*?<\/w:pPrChange>/g, '');

    // 2. Rejoin delimiters split across runs/tags:  {<...>{ -> {{   and  }<...>} -> }}
    //    Loop to collapse delimiters split into 3+ pieces.
    for (let i = 0; i < 6; i++) {
      xml = xml.replace(/\{(?:\s*<[^>]+>\s*)+\{/g, '{{');
      xml = xml.replace(/\}(?:\s*<[^>]+>\s*)+\}/g, '}}');
    }

    // 3. Normalize accidental 3+ braces.
    xml = xml.replace(/\{{3,}/g, '{{');
    xml = xml.replace(/\}{3,}/g, '}}');

    // 4. Strip any XML tags left INSIDE a placeholder: {{<runs>key<runs>}} -> {{key}}
    xml = xml.replace(/\{\{[\s\S]*?\}\}/g, (m) => m.replace(/<[^>]+>/g, ''));

    // 5. Force every filled value to render as plain Times New Roman, 12pt, black.
    //    Templates often mark {{...}} with a distinct font, light color, small
    //    size and a dark/gray background; we strip those overrides and inject the
    //    desired formatting so the value looks like normal body text.
    const FORCE_RPR =
      '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
      '<w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/>';
    xml = xml.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
      if (!run.includes('{{')) return run;
      if (/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/.test(run)) {
        return run.replace(/<w:rPr\b([^>]*)>([\s\S]*?)<\/w:rPr>/, (m, attrs, inner) => {
          inner = inner
            .replace(/<w:rFonts\b[^>]*\/?>/g, '')
            .replace(/<w:color\b[^>]*\/?>/g, '')
            .replace(/<w:sz\b[^>]*\/?>/g, '')
            .replace(/<w:szCs\b[^>]*\/?>/g, '')
            .replace(/<w:shd\b[^>]*\/?>/g, '')
            .replace(/<w:highlight\b[^>]*\/?>/g, '');
          return `<w:rPr${attrs}>${FORCE_RPR}${inner}</w:rPr>`;
        });
      }
      return run.replace(/(<w:r\b[^>]*>)/, `$1<w:rPr>${FORCE_RPR}</w:rPr>`);
    });

    return xml;
  }

  function fixDuplicateDelimiters(zip) {
    for (const part of XML_PARTS) {
      const file = zip.files[part];
      if (!file) continue;
      zip.file(part, preprocessXML(file.asText()));
    }
  }

  function handleDocxError(e) {
    const errors = e.properties && e.properties.errors;
    if (errors && errors.length) {
      const msgs = errors
        .map((err) => (err.properties && err.properties.id) || err.message || String(err))
        .filter(Boolean)
        .slice(0, 3)
        .join('; ');
      throw new Error(`Template invalid (${errors.length} erori): ${msgs}. Deschideți .docx în Word, acceptați modificările urmărite și salvați din nou.`);
    }
    throw new Error('Eroare la generarea documentului: ' + e.message);
  }

  async function generateDOCX(templateBuffer, fields, fileName) {
    const zip = new PizZip(templateBuffer);
    fixDuplicateDelimiters(zip);

    const Docxtemplater = window.docxtemplater || window.Docxtemplater;

    let doc;
    try {
      doc = new Docxtemplater(zip, {
        delimiters: { start: '{{', end: '}}' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '',
        parser: (tag) => ({
          get: (scope) => {
            const key = tag.trim();
            return key in scope ? scope[key] : '';
          },
        }),
      });
    } catch (e) {
      handleDocxError(e);
    }

    try {
      doc.render(fields);
    } catch (e) {
      handleDocxError(e);
    }

    const blob = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const name = fileName.replace(/\.docx$/i, '') + '.docx';
    saveAs(blob, name);
    return name;
  }

  async function generateBlob(templateBuffer, fields) {
    const zip = new PizZip(templateBuffer);
    fixDuplicateDelimiters(zip);
    const Docxtemplater = window.docxtemplater || window.Docxtemplater;
    let doc;
    try {
      doc = new Docxtemplater(zip, {
        delimiters: { start: '{{', end: '}}' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '',
        parser: (tag) => ({ get: (scope) => { const k = tag.trim(); return k in scope ? scope[k] : ''; } }),
      });
    } catch (e) { handleDocxError(e); }
    try { doc.render(fields); } catch (e) { handleDocxError(e); }
    return doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  return { generateDOCX, generateBlob };
})();
