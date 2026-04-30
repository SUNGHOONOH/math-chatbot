import { notFound } from 'next/navigation';

export const metadata = {
  title: '선생님·학원용 AHA — 준비 중',
  robots: {
    index: false,
    follow: false,
  },
};

export default function TeachersPage() {
  notFound();
}
