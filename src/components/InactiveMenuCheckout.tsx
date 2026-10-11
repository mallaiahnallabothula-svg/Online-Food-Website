import { OrderTrackingModal } from './OrderTrackingModal';
import { useRef, useState } from 'react';
import { createInactiveMenuCheckoutSession, type MenuCheckoutRequest, type TestPayment } from '../utils/inactiveMenuCheckout';

/** Only rendered by an explicitly injected isolated test harness. */
export function InactiveMenuCheckout({ request, pay }: { request: MenuCheckoutRequest; pay: TestPayment }) {
  const session = useRef<ReturnType<typeof createInactiveMenuCheckoutSession> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [finished, setFinished] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingToken, setTrackingToken] = useState('');
  if (import.meta.env.MODE !== 'test') return null;
  async function submit() {
    if (busy || finished) return;
    setBusy(true);
    try {
      session.current ??= createInactiveMenuCheckoutSession(request, pay);
      const result = await session.current.run();
      setTrackingToken(result.customerAccessToken);
      setFinished(true);
      setMessage(result.status === 'CONFIRMED' ? 'Payment verified. Order confirmed.' : 'Payment needs manual review. Do not pay again.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to verify checkout.');
    } finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <button type="button" disabled={busy || finished} onClick={submit} className="rounded-lg border p-3 disabled:opacity-50">
      {busy ? 'Verifying…' : session.current ? 'Retry same checkout' : 'Test checkout'}
    </button>
    <p role="status">{message}</p>
    {trackingToken ? <button type="button" onClick={() => setTrackingOpen(true)}>Track order</button> : null}
    <OrderTrackingModal isOpen={trackingOpen} onClose={() => setTrackingOpen(false)} initialOrderId={trackingToken} />
  </div>;
}
