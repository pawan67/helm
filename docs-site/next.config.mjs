import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: 'standalone',
};

export default withMDX(config);
