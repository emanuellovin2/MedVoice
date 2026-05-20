const Template = (() => {
  let _current = null;

  const DEFAULT_FIELDS = [
    { key: 'pacient',                    label: 'Pacient' },
    { key: 'data_nasterii',              label: 'Data nașterii' },
    { key: 'perioada',                   label: 'Internat în perioada' },
    { key: 'diagnostic_1',               label: 'Diagnostic 1' },
    { key: 'diagnostic_2',               label: 'Diagnostic 2' },
    { key: 'diagnostic_3',               label: 'Diagnostic 3' },
    { key: 'diagnostic_4',               label: 'Diagnostic 4' },
    { key: 'diagnostic_5',               label: 'Diagnostic 5' },
    { key: 'greutate_i',                 label: 'Greutate I' },
    { key: 'greutate_ii',                label: 'Greutate II' },
    { key: 'inaltime',                   label: 'Înălțime' },
    { key: 'imc',                        label: 'IMC' },
    { key: 'ecografie_abdominala',       label: 'Ecografie abdominală' },
    { key: 'eco_tiroida',                label: 'Eco tiroidă' },
    { key: 'eco_carotide_comune',        label: 'Eco carotide comune' },
    { key: 'eco_cardio',                 label: 'Eco cardio' },
    { key: 'a_beneficiat_de',            label: 'A beneficiat de' },
    { key: 'sa_administrat',             label: 'S-a administrat' },
    { key: 'recomandare_1',              label: 'Recomandare 1' },
    { key: 'recomandare_2',              label: 'Recomandare 2' },
    { key: 'recomandare_3',              label: 'Recomandare 3' },
    { key: 'recomandare_4',              label: 'Recomandare 4' },
    { key: 'recomandare_5',              label: 'Recomandare 5' },
    { key: 'recomandare_6',              label: 'Recomandare 6' },
    { key: 'recomandare_7',              label: 'Recomandare 7' },
    { key: 'recomandare_8',              label: 'Recomandare 8' },
    { key: 'recomandare_9',              label: 'Recomandare 9' },
    { key: 'recomandare_10',             label: 'Recomandare 10' },
    { key: 'recomandare_11',             label: 'Recomandare 11' },
    { key: 'recomandare_12',             label: 'Recomandare 12' },
    { key: 'recomandare_13',             label: 'Recomandare 13' },
    { key: 'recomandare_14',             label: 'Recomandare 14' },
    { key: 'recomandare_15',             label: 'Recomandare 15' },
    { key: 'recomandare_16',             label: 'Recomandare 16' },
    { key: 'recomandare_17',             label: 'Recomandare 17' },
    { key: 'recomandare_18',             label: 'Recomandare 18' },
    { key: 'recomandare_19',             label: 'Recomandare 19' },
    { key: 'recomandare_20',             label: 'Recomandare 20' },
    { key: 'data',                       label: 'Data' },
    { key: 'medic',                      label: 'Medic' },
    // legacy keys kept for backward compatibility
    { key: 'varsta',                     label: 'Vârstă' },
    { key: 'diagnostic',                 label: 'Diagnostic' },
    { key: 'tratament',                  label: 'Tratament' },
    { key: 'recomandari',                label: 'Recomandări' },
    { key: 'observatii',                 label: 'Observații' },
    { key: 'eco_cardio',                 label: 'Eco cardio' },
    { key: 'terapie',                    label: 'A beneficia de urmatoarea terapie' },
    { key: 'medicatie_internare',        label: 'Pe parcursul internării i s-au administrat' },
  ];

  function extractPlaceholders(zip) {
    const found = new Set();
    const regex = /\{\{([^}]+)\}\}/g;
    const parts = [
      'word/document.xml',
      'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
      'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml',
    ];
    for (const part of parts) {
      const file = zip.files[part];
      if (!file) continue;
      const text = file.asText().replace(/<[^>]+>/g, '');
      let m;
      while ((m = regex.exec(text)) !== null) {
        const key = m[1].trim();
        if (key) found.add(key);
      }
      regex.lastIndex = 0;
    }
    return [...found];
  }

  async function loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target.result;
          const zip = new PizZip(buffer);
          const keys = extractPlaceholders(zip);

          // Build field list: matched defaults first (preserving label), then unknown keys
          const defaultMap = Object.fromEntries(DEFAULT_FIELDS.map((f) => [f.key, f.label]));
          const fields = [];

          // 1. defaults that exist in the template
          for (const f of DEFAULT_FIELDS) {
            if (keys.includes(f.key)) fields.push(f);
          }
          // 2. any extra {{keys}} not in defaults
          for (const key of keys) {
            if (!defaultMap[key]) {
              fields.push({ key, label: labelFor(key) });
            }
          }
          // 3. if template has zero placeholders, use full default list
          if (fields.length === 0) {
            throw new Error(
              'Nu s-au găsit câmpuri {{placeholder}} în template.\n' +
              'Adaugă câmpuri de forma {{pacient}}, {{diagnostic}} etc.'
            );
          }

          _current = {
            name: file.name.replace(/\.docx?$/i, ''),
            fileName: file.name,
            fields,        // [{ key, label }]
            rawBytes: buffer,
          };
          resolve(_current);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Eroare la citirea fișierului'));
      reader.readAsArrayBuffer(file);
    });
  }

  function labelFor(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function getCurrent()    { return _current; }
  function setCurrent(tpl) { _current = tpl; }
  function getDefaultFields() { return DEFAULT_FIELDS; }

  return { loadFromFile, getCurrent, setCurrent, labelFor, getDefaultFields };
})();
