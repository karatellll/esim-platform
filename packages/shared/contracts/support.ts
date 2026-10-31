export interface SupportMessage { id: string; text: string; created_at: string; status: 'saved' }
export interface SupportResponse { messages: SupportMessage[]; operator_connected: boolean }
export interface SupportMessageRequest { text: string }
