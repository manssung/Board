import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config'; // .env 파일을 읽기 위해 추가

// --- 기본 설정 ---
const app = express();
const port = 3001;
app.use(cors());
app.use(express.json()); // React에서 보낸 JSON 데이터를 읽기 위해 추가

// --- 제미나이 API 설정 ---
// .env 파일에서 API 키를 안전하게 불러옵니다.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest"});

// --- 메인 API 로직 ---
// '/api/generate' 주소로 POST 요청이 들어왔을 때의 규칙
app.post('/api/generate', async (req, res) => {
  try {
    // 1. React 앱에서 보낸 prompt 데이터를 가져옵니다.
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).send('prompt 내용이 필요합니다.');
    }

    // 2. 제미나이 모델에게 prompt를 전달하여 결과를 요청합니다.
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 3. 성공하면, 제미나이가 생성한 텍스트를 React 앱에 보내줍니다.
    res.send({ text });

  } catch (error) {
    console.error("제미나이 API 호출 중 오류 발생:", error);
    res.status(500).send("서버에서 AI 요청 처리 중 오류가 발생했습니다.");
  }
});

// --- 서버 실행 ---
app.listen(port, () => {
  console.log(`✅ MCP 서버가 http://localhost:${port} 에서 제미나이를 사용할 준비가 되었습니다.`);
});