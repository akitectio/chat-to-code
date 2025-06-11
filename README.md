# Hệ Thống Chatbot Mô Phỏng Công Ty Phát Triển Phần Mềm

## Giới thiệu

Dự án này mô phỏng một hệ thống chatbot hoạt động như một công ty phát triển phần mềm với ba vai trò chính:

1.  **BA (Business Analyst)**: Phân tích nghiệp vụ và yêu cầu cho đội phát triển
2.  **Dev (Developer)**: Phát triển sản phẩm dựa trên phân tích của BA
3.  **Tester**: Viết test case và thực hiện automation test để đảm bảo chất lượng sản phẩm

Các chatbot này sẽ tương tác với nhau để tạo ra một sản phẩm hoàn chỉnh, mô phỏng quy trình phát triển phần mềm thực tế.

## Cấu trúc dự án

    ├── src/
    │   ├── agents/           # Định nghĩa các agent chatbot
    │   │   ├── ba.js         # Agent Business Analyst
    │   │   ├── dev.js        # Agent Developer
    │   │   └── tester.js     # Agent Tester
    │   ├── core/             # Các thành phần cốt lõi của hệ thống
    │   │   ├── chat.js       # Xử lý giao tiếp giữa các agent
    │   │   ├── memory.js     # Quản lý bộ nhớ và ngữ cảnh
    │   │   └── workflow.js   # Quản lý luồng công việc
    │   ├── models/           # Các model dữ liệu
    │   │   ├── project.js    # Model dự án
    │   │   ├── task.js       # Model nhiệm vụ
    │   │   └── test.js       # Model test case
    │   ├── utils/            # Các tiện ích
    │   │   ├── logger.js     # Ghi log
    │   │   ├── helpers.js    # Các hàm hỗ trợ
    │   │   └── ollama-client.js # Client giao tiếp với Ollama API
    │   └── index.js          # Điểm khởi đầu ứng dụng
    ├── config/               # Cấu hình hệ thống
    │   ├── default.js        # Cấu hình mặc định
    │   └── ollama.js         # Cấu hình cho Ollama
    ├── tests/                # Unit tests và integration tests
    ├── examples/             # Ví dụ sử dụng
    ├── package.json          # Quản lý dependencies
    ├── OLLAMA_SETUP.md       # Hướng dẫn cài đặt và sử dụng Ollama
    └── README.md             # Tài liệu dự án

## Cài đặt

```bash
npm install
```

## Cài đặt Ollama

Dự án này sử dụng Ollama để chạy các mô hình ngôn ngữ lớn (LLM) cục bộ thay vì sử dụng OpenAI API. Xem hướng dẫn chi tiết trong file [OLLAMA_SETUP.md](./OLLAMA_SETUP.md).

## Cấu hình

Tạo file `.env` và cấu hình Ollama API:

    OLLAMA_BASE_URL=http://localhost:11434
    OLLAMA_DEFAULT_MODEL=phi3:mini

## Sử dụng

```bash
npm start
```

## Quy trình làm việc

1.  **BA** phân tích yêu cầu và tạo ra các tài liệu đặc tả
2.  **Dev** nhận đặc tả từ BA và phát triển code
3.  **Tester** viết test case và thực hiện kiểm thử
4.  Các agent tương tác với nhau để giải quyết vấn đề và hoàn thiện sản phẩm

## Lưu ý

Đảm bảo Ollama đã được cài đặt và đang chạy trước khi khởi động dự án. Xem thêm chi tiết trong [OLLAMA_SETUP.md](./OLLAMA_SETUP.md).

## Tìm kiếm Google và Phân tích Dữ liệu

Hệ thống được tích hợp khả năng tìm kiếm Google khi không tìm thấy dữ liệu nội bộ và cần phân tích thêm:

### Tính năng chính

-   Tự động tìm kiếm thông tin trên Google khi dữ liệu nội bộ không đủ
-   Phân tích và tổng hợp kết quả từ nhiều nguồn
-   Trích xuất thông tin liên quan từ các trang web
-   Cung cấp trích dẫn nguồn cho thông tin được sử dụng

### Các kỹ thuật tìm kiếm nâng cao

-   Sử dụng dấu ngoặc kép ("") để tìm kiếm cụm từ chính xác
-   Dùng từ khóa OR hoặc ký tự | để tìm một trong hai từ khóa
-   Thêm dấu + trước từ khóa để bắt buộc kết quả phải chứa từ đó
-   Dùng dấu - để loại trừ từ khóa khỏi kết quả
-   Sử dụng cú pháp site:domain để tìm kiếm trong một trang web cụ thể
-   Dùng dấu \* thay cho phần từ khóa không nhớ rõ

## Giấy phép

MIT
