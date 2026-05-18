# Jangseon CM 대가산출 웹

간단한 CM(건설사업관리) 대가 산출 도구의 웹 포팅입니다. React(Create React App)로 작성되었고 GitHub Pages를 통해 다음 URL에 배포되어 있습니다:

- 데모 사이트: https://kyoungbinkim.github.io/jangseonweb
 - 데모 사이트: https://kyoungbinkim.github.io/jangseonweb

연락처
- 수정 필요 사항이 있거나 개선 제안이 있으면 kyoungbin1996@gmail.com 으로 연락주세요.

주요 기능
- 사업명과 공사비(억원)를 입력하면 2026년 CM 기준에 따라 평균공기, 노무비, 직접경비, 공급가액, 부가세 및 총 합계를 계산합니다.
- 계산 결과를 파일로 내보내기(.txt 다운로드)하거나 클립보드에 복사할 수 있습니다.
- 결과 자동 저장(로컬 저장소)을 지원하며, 저장된 이력을 불러오고 개별 항목을 파일로 저장할 수 있습니다.

빠른 시작
1. 레포지토리 클론
```
git clone git@github.com:kyoungbinkim/jangseonweb.git
cd jangseonweb
```
2. 의존성 설치
```
npm install
```
3. 개발 서버 실행
```
npm start
```
브라우저에서 http://localhost:3000 을 열어 앱을 확인하세요.

배포
- 이 레포지토리는 gh-pages를 사용하여 GitHub Pages로 배포됩니다. 배포 명령:
```
npm run deploy
```
배포 전 package.json의 "homepage" 필드를 배포 URL로 설정해야 합니다(현재는 https://kyoungbinkim.github.io/jangseonweb 로 설정됨).

파일 및 구조
- src/CMScreen.js: 메인 화면(입력, 계산, 결과, 이력 관리)
- src/App.js: CMScreen을 렌더링
- src/App.css: 간단한 스타일

개선 포인트(향후 작업)
- 반응형 디자인 강화(모바일 최적화)
- 결과 PDF/Excel 내보내기 추가
- 입력 유효성 강화 및 국제화(i18n)
- GitHub Actions를 통한 CI/CD 자동화

문제 발생 시
- 배포가 정상적으로 반영되지 않으면 GitHub Pages 설정 또는 gh-pages 브랜치(gh-pages)의 내용을 확인하세요.

라이선스
- MIT (원하시면 지정)
