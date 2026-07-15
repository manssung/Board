// check.js (프로젝트 폴더에 생성)
// 내 키로 사용 가능한 모델 이름을 구글 서버에 직접 물어보는 코드입니다.

async function checkModels() {
  const API_KEY = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log("=== 내 키로 사용 가능한 모델 목록 ===");
    // generateContent 기능을 지원하는 모델만 필터링해서 보여줌
    const available = data.models
      .filter(m => m.supportedGenerationMethods.includes("generateContent"))
      .map(m => m.name.replace("models/", ""));
      
    console.log(available);
    console.log("======================================");
    console.log("👉 위 목록에 있는 이름 중 하나를 골라서 쓰시면 100% 됩니다.");

  } catch (e) {
    console.log("조회 실패:", e);
  }
}

checkModels();
