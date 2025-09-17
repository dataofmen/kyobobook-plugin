// 교보문고 검색 테스트 스크립트
const https = require('https');
const fs = require('fs');

function fetchKyobobookSearch() {
  const searchUrl = 'https://search.kyobobook.co.kr/search?keyword=%EC%83%9D%EA%B0%81&target=total&gbCode=TOT';

  console.log('검색 URL:', searchUrl);

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  };

  https.get(searchUrl, options, (res) => {
    console.log('응답 상태:', res.statusCode);
    console.log('응답 헤더:', res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('응답 크기:', data.length);

      // HTML 파일로 저장
      fs.writeFileSync('/Users/hmkwon/Project/007_kyobobook_plugin/debug-search.html', data);
      console.log('HTML 저장됨: debug-search.html');

      // 기본적인 구조 분석
      console.log('\n=== HTML 구조 분석 ===');

      // 검색 결과 컨테이너 찾기
      const containerPatterns = [
        /<div[^>]*class="[^"]*search[^"]*result[^"]*"[^>]*>/gi,
        /<div[^>]*class="[^"]*result[^"]*list[^"]*"[^>]*>/gi,
        /<div[^>]*class="[^"]*product[^"]*list[^"]*"[^>]*>/gi,
        /<ul[^>]*class="[^"]*list[^"]*"[^>]*>/gi
      ];

      containerPatterns.forEach((pattern, i) => {
        const matches = data.match(pattern);
        if (matches) {
          console.log(`패턴 ${i+1} 매치:`, matches.slice(0, 3));
        }
      });

      // 이미지 태그 찾기
      console.log('\n=== 이미지 태그 분석 ===');
      const imgPattern = /<img[^>]+>/gi;
      const imgMatches = data.match(imgPattern);
      if (imgMatches) {
        console.log('찾은 이미지 태그 수:', imgMatches.length);
        console.log('처음 5개 이미지 태그:');
        imgMatches.slice(0, 5).forEach((img, i) => {
          console.log(`${i+1}: ${img}`);
        });
      }

      // 제목 링크 찾기
      console.log('\n=== 제목 링크 분석 ===');
      const linkPattern = /<a[^>]*href="[^"]*product[^"]*"[^>]*>.*?<\/a>/gi;
      const linkMatches = data.match(linkPattern);
      if (linkMatches) {
        console.log('찾은 제품 링크 수:', linkMatches.length);
        console.log('처음 3개 링크:');
        linkMatches.slice(0, 3).forEach((link, i) => {
          console.log(`${i+1}: ${link.substring(0, 200)}...`);
        });
      }
    });
  }).on('error', (err) => {
    console.error('요청 오류:', err);
  });
}

fetchKyobobookSearch();