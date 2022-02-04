export interface LoginPayload {
    deviceId?: string;
    deviceName?: string;
    email: string;
    pw: string;
}

export interface LoginPayloadV2 {
    request_type: string;
    signInName: string;
    password: string;
}