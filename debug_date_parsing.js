// Debug script to test date parsing with the actual text from '생각 망치' book

// This is the actual text extracted from .prod_info_text.publish_date element
const actualText = `

                    포레스트북스


                 ·

                    2025년 06월 02일

            `;

console.log('Original text:', JSON.stringify(actualText));

// Simulate the normalizeDomDate function
function normalizeDomDate(raw) {
    if (!raw) return undefined;
    const cleaned = (raw || '')
        .replace(/\u00A0/g, ' ')
        .replace(/[\(（][월화수목금토일][\)）]/g, '')
        .replace(/[\u2460-\u2473]/g, '')
        .replace(/예정|발간예정|출간예정|예약판매|출시예정/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    console.log('Cleaned text:', JSON.stringify(cleaned));

    const tryMatch = (re) => {
        const m = cleaned.match(re);
        console.log('Regex test:', re.toString(), 'Match:', m);
        if (!m) return undefined;
        const y = m[1];
        const mo = m[2]?.padStart(2, '0');
        const d = m[3]?.padStart(2, '0');
        if (!y || !mo || !d) return undefined;
        const iso = `${y}-${mo}-${d}`;
        const dt = new Date(iso);
        return isNaN(dt.getTime()) ? undefined : iso;
    };

    return (
        tryMatch(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?/) ||
        tryMatch(/(\d{4})\s*[\.\/]\s*(\d{1,2})\s*[\.\/]\s*(\d{1,2})/) ||
        tryMatch(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*(?:일|일자)?/)
    );
}

const result = normalizeDomDate(actualText);
console.log('Final result:', result);

// Test with simplified text to see if the regex works
const simpleTest = "2025년 06월 02일";
console.log('\nSimple test with:', JSON.stringify(simpleTest));
const simpleResult = normalizeDomDate(simpleTest);
console.log('Simple result:', simpleResult);