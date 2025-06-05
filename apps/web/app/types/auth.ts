export type UserRole = 'customer' | 'agent' | 'company';

export interface BaseUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  verified: boolean;
  picture?: string;
  authType: 'local' | 'google';
}

export interface CustomerUser extends BaseUser {
  role: 'customer';
}

export interface AgentUser extends BaseUser {
  role: 'agent';
  companyId: string;
}

export interface CompanyUser extends BaseUser {
  role: 'company';
  support_emails: string[];
}

export type User = CustomerUser | AgentUser | CompanyUser;

export interface CompanyRegistrationData {
  name: string;          
  o_name: string;        
  o_email: string;       
  o_password: string;    
  support_emails: string[];
}

export interface AgentRegistrationData {
  name: string;
  email: string;
  password: string;
  companyId: string;
}

export interface CustomerRegistrationData {
  name: string;
  email: string;
  password: string;
}

export interface LoginFormData {
  email: string;
  password: string;
  role: UserRole;
  companyId?: string; 
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'customer' | 'agent' | 'company';
    verified: boolean;
    picture?: string;
    companyId?: string;
    authType: 'local' | 'google';
  };
  message?: string;
}