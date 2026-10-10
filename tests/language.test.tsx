// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext';
import { AnalyticsDashboard } from '../src/components/OwnerPortal/AnalyticsDashboard';
import { AuditLogs } from '../src/components/OwnerPortal/AuditLogs';
import { CustomerFeedbackView } from '../src/components/OwnerPortal/CustomerFeedbackView';
import { OrderTrackingModal } from '../src/components/OrderTrackingModal';
import { uiError, paymentStatusLabel } from '../src/utils/uiCopy';
import { translations } from '../src/utils/translations';

afterEach(() => { cleanup(); localStorage.clear(); });
function Switch() {
  const { language, setLanguage } = useLanguage();
  return <button onClick={() => setLanguage(language === 'en' ? 'te' : 'en')}>Switch</button>;
}
it('switches owner panels and an open tracking modal in both directions', () => {
  localStorage.setItem('miv_language', 'en');
  const { container } = render(<LanguageProvider><Switch />
    <AnalyticsDashboard analytics={null} /><AuditLogs logs={[]} />
    <CustomerFeedbackView feedbacks={[]} averageRating={0} totalFeedbacks={0} />
    <OrderTrackingModal isOpen onClose={() => {}} />
  </LanguageProvider>);
  expect(container.textContent).not.toMatch(/[\u0c00-\u0c7f]/);
  fireEvent.click(screen.getByText('Switch'));
  expect(container.textContent).toContain('నా ఆర్డర్లు');
  expect(document.documentElement.lang).toBe('te');
  fireEvent.click(screen.getByText('Switch'));
  expect(container.textContent).not.toMatch(/[\u0c00-\u0c7f]/);
  expect(localStorage.getItem('miv_language')).toBe('en');
});
it('translates retained validation messages and payment statuses', () => {
  expect(uiError(translations.te.selectStarRatingError, 'en')).toBe(translations.en.selectStarRatingError);
  expect(uiError(translations.en.selectStarRatingError, 'te')).toBe(translations.te.selectStarRatingError);
  expect(paymentStatusLabel('PAID', 'en')).toBe('Paid');
  expect(paymentStatusLabel('PAID', 'te')).toMatch(/[\u0c00-\u0c7f]/);
});
