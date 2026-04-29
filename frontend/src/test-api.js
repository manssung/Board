// test-api.mjs

// 1. require 대신 import를 사용합니다. (빨간 줄 해결!)
import { GoogleGenerativeAI } from "@google/generative-ai";

async function main() {
  // ⚠️ 주의: 스크린샷에 노출된 키는 폐기하고 새로 발급받는 것이 안전합니다.
  const API_KEY = "AIzaSyDcQeGQFp5tRZHldjBNPzWNFXaO6WrKAmw"; 

  if (!API_KEY) { console.error("❌ 키 입력 필요!"); return; }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log("📨 [gemini-2.0-flash-exp] 질문 전송 중...");
    
    const response = await model.generateContent("AI야, 짧게 인사해줘.");
    const text = response.response.text();
    
    console.log("--------------------------------");
    console.log("✅ 성공! 답변:", text);
    console.log("--------------------------------");

  } catch (error) {
    console.error("🚨 에러 발생:", error.message);
  }
}

main();