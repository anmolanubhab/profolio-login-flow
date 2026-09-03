import { emptyResume, type ResumeDoc, type TemplateId } from '@/lib/resume/schema';

/** Filler content for template thumbnails only — never saved. */
export function sampleDoc(template: TemplateId): ResumeDoc {
  const d = emptyResume();
  d.design.template = template;
  d.basics = {
    fullName: 'Riya Sharma',
    headline: 'Senior Product Designer',
    email: 'riya@example.com',
    phone: '+1 512 555 0143',
    location: 'Austin, TX',
    website: 'riya.design',
    linkedin: 'linkedin.com/in/riya',
  };
  d.summary =
    '<p>Product designer with 6 years shipping end-to-end across web and mobile. Strong in research, systems, and partnering closely with engineering.</p>';
  d.experience = [
    {
      id: 's1',
      role: 'Senior Product Designer',
      company: 'Northwind Labs',
      location: 'Austin, TX',
      startDate: 'Mar 2022',
      endDate: '',
      current: true,
      description:
        '<ul><li>Led design from discovery to launch across three product areas.</li><li>Built a component library that cut handoff time.</li><li>Ran research that reshaped the onboarding flow.</li></ul>',
    },
    {
      id: 's2',
      role: 'Product Designer',
      company: 'Brightpath',
      location: 'Remote',
      startDate: 'Jun 2019',
      endDate: 'Feb 2022',
      current: false,
      description:
        '<ul><li>Owned the mobile checkout redesign end to end.</li><li>Partnered with data to define and track success metrics.</li></ul>',
    },
  ];
  d.education = [
    {
      id: 'e1',
      school: 'University of Texas at Austin',
      degree: 'B.S.',
      field: 'Human-Computer Interaction',
      location: 'Austin, TX',
      startDate: '2015',
      endDate: '2019',
      description: '',
    },
  ];
  d.skills = [
    { id: 'k1', name: 'User research', level: 5 },
    { id: 'k2', name: 'Design systems', level: 4 },
    { id: 'k3', name: 'Prototyping', level: 4 },
    { id: 'k4', name: 'Figma', level: 5 },
    { id: 'k5', name: 'Accessibility', level: 3 },
  ];
  return d;
}
