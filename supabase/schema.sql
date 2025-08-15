-- BillPaymentApp Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20) UNIQUE,
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    kyc_verified_at TIMESTAMP,
    credit_building_opted_in BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Bills table
CREATE TABLE public.bills (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    biller_name VARCHAR(255) NOT NULL,
    biller_type VARCHAR(50) CHECK (biller_type IN ('utility', 'council', 'telecom', 'water', 'broadband', 'other')),
    account_number VARCHAR(100),
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'paid', 'overdue', 'failed')),
    recurring BOOLEAN DEFAULT false,
    recurring_frequency VARCHAR(20) CHECK (recurring_frequency IN ('monthly', 'quarterly', 'annually')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table
CREATE TABLE public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    fee DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) GENERATED ALWAYS AS (amount + fee) STORED,
    payment_method VARCHAR(50) CHECK (payment_method IN ('bank_transfer', 'card', 'open_banking')),
    external_transaction_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    failure_reason TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payment methods table
CREATE TABLE public.payment_methods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(20) CHECK (type IN ('bank_account', 'card')),
    provider VARCHAR(50), -- 'truelayer', 'stripe', etc
    last_four VARCHAR(4),
    bank_name VARCHAR(100),
    is_default BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('reminder', 'payment_success', 'payment_failed', 'overdue', 'kyc_update')),
    channel VARCHAR(20) CHECK (channel IN ('sms', 'email', 'push')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log table
CREATE TABLE public.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_bills_user_id ON public.bills(user_id);
CREATE INDEX idx_bills_due_date ON public.bills(due_date);
CREATE INDEX idx_bills_status ON public.bills(status);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_bill_id ON public.transactions(bill_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can only see and edit their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Bills: Users can only manage their own bills
CREATE POLICY "Users can view own bills" ON public.bills
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bills" ON public.bills
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bills" ON public.bills
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bills" ON public.bills
    FOR DELETE USING (auth.uid() = user_id);

-- Transactions: Users can only view their own transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions" ON public.transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payment Methods: Users can only manage their own payment methods
CREATE POLICY "Users can view own payment methods" ON public.payment_methods
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payment methods" ON public.payment_methods
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods" ON public.payment_methods
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods" ON public.payment_methods
    FOR DELETE USING (auth.uid() = user_id);

-- Notifications: Users can only view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Functions and Triggers

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON public.bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update bill status to overdue
CREATE OR REPLACE FUNCTION update_overdue_bills()
RETURNS void AS $$
BEGIN
    UPDATE public.bills
    SET status = 'overdue'
    WHERE due_date < CURRENT_DATE
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- View for dashboard statistics
CREATE VIEW public.dashboard_stats AS
SELECT 
    user_id,
    COUNT(DISTINCT CASE WHEN status = 'pending' THEN id END) as pending_bills,
    COUNT(DISTINCT CASE WHEN status = 'overdue' THEN id END) as overdue_bills,
    COUNT(DISTINCT CASE WHEN status = 'paid' AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', CURRENT_DATE) THEN id END) as paid_this_month,
    SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending_amount,
    SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) as total_overdue_amount
FROM public.bills
GROUP BY user_id;

-- Grant permissions for the view
GRANT SELECT ON public.dashboard_stats TO authenticated;

-- Sample data for testing (optional - remove in production)
-- Uncomment below to add test data

/*
-- Insert a test user (password: TestPassword123!)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'test@example.com',
    crypt('TestPassword123!', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
);

-- Insert test bills
INSERT INTO public.bills (user_id, biller_name, biller_type, amount, due_date, status)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'British Gas', 'utility', 75.50, CURRENT_DATE + 7, 'pending'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Thames Water', 'water', 45.00, CURRENT_DATE + 14, 'pending'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'BT Broadband', 'broadband', 35.99, CURRENT_DATE - 2, 'overdue');
*/

COMMENT ON SCHEMA public IS 'BillPaymentApp - UK Bill Payment Platform Database Schema';