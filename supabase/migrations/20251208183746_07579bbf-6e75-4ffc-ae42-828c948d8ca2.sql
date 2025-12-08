-- Fix security definer views by setting them to security invoker
ALTER VIEW public.monthly_financial_summary SET (security_invoker = true);
ALTER VIEW public.monthly_pharmacy_summary SET (security_invoker = true);
ALTER VIEW public.monthly_payer_summary SET (security_invoker = true);