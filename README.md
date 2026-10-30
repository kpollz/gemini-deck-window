# Gemini Desk

Ứng dụng desktop Windows cho **Gemini CLI**, giao tiếp qua **Agent Client Protocol (ACP)**. Giao diện lấy cảm hứng từ quy trình làm việc của Claude Code/Codex: chat theo dự án, duyệt công cụ, xem diff, file explorer và terminal trong cùng một workspace.

> Gemini Desk là dự án độc lập, không phải sản phẩm chính thức của Google.

## Tính năng bản 0.1

- Khởi chạy `gemini --acp` trong thư mục dự án.
- Tạo phiên mới và mở lại phiên bằng `session/load`.
- Streaming câu trả lời, thought, plan và tool call theo `session/update`.
- Duyệt hoặc từ chối từng yêu cầu quyền của agent.
- Nhận diff từ tool call và hiển thị theo file.
- Đổi mode/model khi Gemini CLI cung cấp các capability tương ứng.
- File explorer giới hạn trong workspace đã chọn; hỗ trợ ACP file-system proxy.
- Terminal chạy lệnh trong workspace và ACP terminal capability.
- Lưu metadata phiên/cài đặt cục bộ trên thiết bị.
- Responsive preview cho desktop và mobile.

## Yêu cầu trên Windows

1. **Node.js 22.12 trở lên** và npm.
2. **Gemini CLI** đã cài và đăng nhập:

```powershell
npm install -g @google/gemini-cli
gemini
```

Thoát Gemini CLI sau khi hoàn tất đăng nhập. Kiểm tra `gemini --version` trong PowerShell. Nếu app không tìm thấy executable, mở **Cài đặt** trong Gemini Desk và nhập đường dẫn đầy đủ tới `gemini.cmd`.

## Chạy bản desktop

```powershell
npm install
npm run dev:desktop
```

Lần đầu chạy, chọn **workspace → thư mục dự án**. App sẽ khởi chạy Gemini CLI ở ACP mode. Không cần nhập API key vào Gemini Desk; thông tin xác thực do Gemini CLI quản lý.

## Tạo installer Windows

```powershell
npm run build:desktop
```

Installer NSIS x64 được tạo trong thư mục `release/`. Có thể chọn thư mục cài đặt và tạo shortcut trong quá trình cài.

Nếu chỉ muốn kiểm tra thư mục app đã đóng gói, chưa tạo installer:

```powershell
npm run pack:desktop
```

## Chạy web preview

```powershell
npm run dev
```

Hoặc build static:

```powershell
npm run build
npm run preview
```

**Web preview chỉ dùng dữ liệu minh họa.** Trình duyệt không thể truy cập Gemini CLI, hệ thống file hoặc terminal thật. Các tính năng đó chỉ hoạt động trong app Electron. Cài đặt trên web preview lưu trong localStorage của trình duyệt hiện tại.

## Kiến trúc

- `electron/main.ts`: vòng đời app, ACP client, permission broker, workspace file API và terminal.
- `electron/preload.ts`: IPC bridge có context isolation, không expose Node.js cho renderer.
- `src/App.tsx`: state machine cho phiên, streaming, diff và terminal.
- `src/components/`: giao diện phiên, chat, workspace và dialogs.
- `src/types/`: kiểu dữ liệu desktop/ACP và workspace.

Renderer dùng React + TypeScript + Vite. Desktop shell dùng Electron. ACP dùng package `@zed-industries/agent-client-protocol` và cờ `gemini --acp`.

## Giới hạn hiện tại

- Chưa có Git worktree, checkpoint/revert, MCP manager và image attachment.
- Terminal là command runner có streaming output, chưa phải full PTY như Windows Terminal.
- Diff hiển thị dữ liệu do ACP tool call gửi về; app chưa tự tính diff toàn workspace từ Git.
- Bản 0.1 mới kiểm tra build và web preview; cần kiểm thử end-to-end với tài khoản Gemini CLI trên máy Windows của bạn.
