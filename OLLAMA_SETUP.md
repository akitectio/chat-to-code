# Hướng Dẫn Cài Đặt và Sử Dụng Ollama

## Giới thiệu

Ollama là một công cụ cho phép chạy các mô hình ngôn ngữ lớn (LLM) cục bộ trên máy tính của bạn. Dự án này sử dụng Ollama để chạy các mô hình LLM thay vì sử dụng OpenAI API.

## Cài đặt Ollama

### Windows

1. Tải Ollama từ trang chủ: [https://ollama.ai/download](https://ollama.ai/download)
2. Cài đặt Ollama theo hướng dẫn
3. Sau khi cài đặt, Ollama sẽ chạy như một dịch vụ nền và có sẵn tại địa chỉ `http://localhost:11434`

### macOS

1. Tải Ollama từ trang chủ: [https://ollama.ai/download](https://ollama.ai/download)
2. Kéo ứng dụng Ollama vào thư mục Applications
3. Mở ứng dụng Ollama
4. Ollama sẽ chạy như một dịch vụ nền và có sẵn tại địa chỉ `http://localhost:11434`

### Linux

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

## Tải và Sử Dụng Mô Hình

### Tải mô hình Phi-3 Mini

Dự án này sử dụng mô hình Phi-3 Mini mặc định. Để tải mô hình này, chạy lệnh sau trong terminal:

```bash
ollama pull phi3:mini
```

### Các mô hình khác

Bạn có thể tải và sử dụng các mô hình khác tùy theo nhu cầu và cấu hình máy tính của bạn:

- **Gemma**: `ollama pull gemma:2b` (nhẹ nhất, phù hợp với máy cấu hình thấp)
- **Phi-3 Mini**: `ollama pull phi3:mini` (cân bằng giữa hiệu suất và tài nguyên)
- **Phi-3.5 Mini**: `ollama pull phi3.5:mini` (hiệu suất tốt hơn, hỗ trợ context length 128K)
- **Llama3**: `ollama pull llama3` (mô hình mạnh nhưng yêu cầu nhiều tài nguyên hơn)

## Kiểm Tra Cài Đặt

Để kiểm tra xem Ollama đã được cài đặt và chạy đúng cách, bạn có thể thực hiện lệnh sau:

```bash
curl http://localhost:11434/api/tags
```

Nếu Ollama đang chạy, bạn sẽ nhận được danh sách các mô hình đã tải.

## Cấu Hình Trong Dự Án

Dự án này sử dụng file `.env` để cấu hình Ollama API:

```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=phi3:mini
```

Bạn có thể thay đổi mô hình mặc định bằng cách chỉnh sửa `OLLAMA_DEFAULT_MODEL` trong file `.env`.

## Khắc Phục Sự Cố

### Ollama không khởi động

- Kiểm tra xem Ollama đã được cài đặt đúng cách chưa
- Khởi động lại dịch vụ Ollama
- Kiểm tra xem cổng 11434 có đang được sử dụng bởi ứng dụng khác không

### Không tải được mô hình

- Kiểm tra kết nối internet
- Đảm bảo bạn có đủ dung lượng ổ đĩa
- Thử tải lại mô hình với lệnh `ollama pull <model_name>`

### Mô hình chạy chậm

- Thử sử dụng mô hình nhẹ hơn (như Gemma 2B)
- Đóng các ứng dụng khác để giải phóng tài nguyên
- Nếu máy tính không có GPU, hãy cân nhắc sử dụng các mô hình nhỏ hơn

## Tài Nguyên

- [Trang chủ Ollama](https://ollama.ai/)
- [Tài liệu Ollama](https://github.com/ollama/ollama/blob/main/README.md)
- [Danh sách các mô hình](https://ollama.ai/library)