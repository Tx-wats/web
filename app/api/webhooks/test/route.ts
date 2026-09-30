import { NextRequest, NextResponse } from 'next/server'
import { POST as proxyPost } from '@/app/api/test-webhook/route'

export async function POST(req: NextRequest) {
  return proxyPost(req)
}
