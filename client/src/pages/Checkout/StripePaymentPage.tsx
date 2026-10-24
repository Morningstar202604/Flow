import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreditCard, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface StripeLike {
  elements: (options: { clientSecret: string; appearance?: Record<string, unknown> }) => {
    create: (type: 'payment') => { mount: (selector: string) => void; destroy: () => void };
  };
  confirmPayment: (options: {
    elements: unknown;
    confirmParams: { return_url: string };
  }) => Promise<{ error?: { message?: string } }>;
}

declare global {
  interface Window {
    Stripe?: (key: string) => StripeLike;
  }
}

interface StripeState {
  clientSecret?: string;
  orderId?: string;
  publishableKey?: string;
}

/**
 * Stripe 支付确认页：只在配置了真实 Stripe 密钥时可达。
 * 通过 Stripe.js 的 PaymentElement 完成 3DS/卡支付，成功与否以 webhook 入账为准。
 */
const StripePaymentPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const state = (location.state ?? {}) as StripeState;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const stripeRef = useRef<StripeLike | null>(null);
  const elementsRef = useRef<{ destroy: () => void } | null>(null);
  const paymentElementRef = useRef<{ mount: (selector: string) => void; destroy: () => void } | null>(null);

  useEffect(() => {
    if (!state.clientSecret || !state.publishableKey) {
      setError(language === 'zh' ? '缺少支付会话，请返回结算页重试。' : 'Missing payment session. Please retry from checkout.');
      return;
    }
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        if (!window.Stripe) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Stripe.js failed to load'));
            document.head.appendChild(script);
          });
        }
        if (cancelled || !window.Stripe) return;
        const publishableKey = state.publishableKey as string;
        const clientSecret = state.clientSecret as string;
        const stripe = window.Stripe(publishableKey);
        stripeRef.current = stripe;
        const elements = stripe.elements({ clientSecret });
        elementsRef.current = elements as unknown as { destroy: () => void };
        const paymentElement = elements.create('payment');
        paymentElementRef.current = paymentElement;
        paymentElement.mount('#stripe-payment-element');
        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Stripe init failed');
      }
    };
    void load();
    return () => {
      cancelled = true;
      paymentElementRef.current?.destroy();
    };
  }, [state.clientSecret, state.publishableKey, language]);

  const handleConfirm = async (): Promise<void> => {
    if (!stripeRef.current || !elementsRef.current) return;
    try {
      setSubmitting(true);
      const result = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        confirmParams: {
          return_url: `${window.location.origin}/orders?stripe=return&order=${state.orderId ?? ''}`,
        },
      });
      if (result.error) {
        setError(result.error.message ?? 'Payment failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-lg p-6">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="size-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-slate-900">
            {language === 'zh' ? 'Stripe 安全支付' : 'Secure payment with Stripe'}
          </h1>
        </div>
        <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
          <ShieldCheck className="size-4 text-emerald-600" />
          {language === 'zh'
            ? '卡片信息由 Stripe 直接处理，本站不保存任何卡号。'
            : 'Card details are handled by Stripe; we never store card numbers.'}
        </p>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        <div id="stripe-payment-element" className="min-h-[120px]" />
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => navigate('/checkout')}>
            {language === 'zh' ? '返回结算' : 'Back'}
          </Button>
          <Button className="flex-1" disabled={!ready || submitting} onClick={() => void handleConfirm()}>
            {submitting
              ? (language === 'zh' ? '支付中…' : 'Processing…')
              : (language === 'zh' ? '确认支付' : 'Pay now')}
          </Button>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          {language === 'zh'
            ? '支付成功后订单状态由 Stripe webhook 确认，通常几秒内完成。'
            : 'Order status is confirmed by the Stripe webhook, usually within seconds.'}
        </p>
      </Card>
    </div>
  );
};

export default StripePaymentPage;
