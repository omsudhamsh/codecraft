/**
 * Stack selection.
 *
 * In the live assessment the candidate picks a framework before the clock starts, and the
 * repository they are handed matches that choice. This build executes JavaScript, so only
 * the JavaScript profiles are fully runnable here — the others are listed because they are
 * what the real assessment offers, and selecting one is recorded on the attempt.
 */

export const STACKS = [
  {
    id: 'react-node',
    label: 'React + Node.js',
    detail: 'React SPA on an Express API',
    languages: ['JavaScript', 'TypeScript'],
    runnable: true,
    default: true,
  },
  {
    id: 'react-nest',
    label: 'React + NestJS',
    detail: 'React SPA on a NestJS API — decorators, modules, DI',
    languages: ['TypeScript'],
    runnable: true,
  },
  {
    id: 'node-express',
    label: 'Node.js + Express',
    detail: 'API only, no client layer',
    languages: ['JavaScript', 'TypeScript'],
    runnable: true,
  },
  {
    id: 'react-spring',
    label: 'React + Spring Boot',
    detail: 'React SPA on a Java/Spring Boot API',
    languages: ['Java'],
    runnable: false,
  },
  {
    id: 'spring-react-native',
    label: 'Spring Boot + React Native',
    detail: 'Java API with a React Native client',
    languages: ['Java', 'JavaScript'],
    runnable: false,
  },
];

export const DEFAULT_STACK = 'react-node';

export function findStack(id) {
  return STACKS.find((stack) => stack.id === id) ?? STACKS[0];
}

export function runnableStacks() {
  return STACKS.filter((stack) => stack.runnable);
}
