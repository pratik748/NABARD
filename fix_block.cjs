const fs = require('fs');
let code = fs.readFileSync('src/components/ActiveSession.tsx', 'utf8');

code = code.replace(
  /\}          \} else \{\n        const errData = await response\.json\(\)\.catch\(\(\) => \(\{\}\)\);\n        if \(response\.status === 503\) \{\n          alert\('API Key Error: ' \+ \(errData\.reasoning \|\| 'Missing Gemini API Key'\)\);\n        \} else \{\n          console\.error\('Extraction failed:', response\.statusText\);\n        \}\n      \}\n    \} catch \(e\) \{\n      console\.error\('Error extracting speech parameters:', e\);\n    \} finally \{/,
  `} else {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 503) {
          alert('API Key Error: ' + (errData.reasoning || 'Missing Gemini API Key'));
        } else {
          console.error('Extraction failed:', response.statusText);
        }
      }
    } catch (e) {
      console.error('Error extracting speech parameters:', e);
    } finally {`
);

fs.writeFileSync('src/components/ActiveSession.tsx', code);
