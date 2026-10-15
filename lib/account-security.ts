export function newPasswordError(
  password: string,
  confirmation: string,
): string | null {
  if (
    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[^\s]{8,128}$/.test(
      password,
    )
  )
    return "Mật khẩu cần 8–128 ký tự, chữ hoa, chữ thường, số, ký tự đặc biệt và không có khoảng trắng.";
  return password === confirmation ? null : "Mật khẩu nhập lại không khớp.";
}
