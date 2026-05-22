import type { ApiClient } from "../client.ts";

export interface LoginResult {
  usertoken: string;
  userid: number;
  allowed_to_download: boolean;
  allowed_to_stream: boolean;
  usertype: string;
  expire: string;
  useremail: string;
  username: string;
  gavatar: string;
  avatar: string;
}

export function login(
  client: ApiClient,
  email: string,
  password: string,
  recaptchaResponse: string,
): Promise<LoginResult> {
  return client.post<LoginResult>("/action/loginV2", {
    formBody: {
      userlogin: email,
      userpassword: password,
      "g-recaptcha-response": recaptchaResponse,
    },
  });
}
