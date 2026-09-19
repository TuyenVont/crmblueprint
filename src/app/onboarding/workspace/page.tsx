'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function WorkspaceOnboardingPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)
  const [timezone] = useState('Asia/Ho_Chi_Minh')
  const [currency] = useState('VND')
  const [language] = useState('vi')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)
    if (!isSlugManuallyEdited) {
      setSlug(slugify(newName))
    }
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true)
    setSlug(e.target.value.toLowerCase())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim() || name.trim().length < 2) {
      setError('Tên workspace phải có ít nhất 2 ký tự.')
      return
    }

    const cleanSlug = slugify(slug)
    if (!cleanSlug) {
      setError('Slug workspace không hợp lệ.')
      return
    }

    setLoading(true)

    try {
      const { data: workspaceId, error: rpcError } = await supabase.rpc(
        'create_workspace',
        {
          p_name: name.trim(),
          p_slug: cleanSlug,
          p_timezone: timezone,
          p_currency: currency,
          p_language: language,
        }
      )

      if (rpcError) {
        if (
          rpcError.message?.includes('duplicate key') ||
          rpcError.message?.includes('workspaces_slug_key') ||
          rpcError.code === '23505'
        ) {
          setError('Slug này đã được sử dụng. Vui lòng chọn slug khác.')
        } else if (rpcError.message?.includes('INVALID_WORKSPACE_NAME')) {
          setError('Tên workspace không hợp lệ.')
        } else if (rpcError.message?.includes('INVALID_WORKSPACE_SLUG')) {
          setError('Slug workspace không hợp lệ.')
        } else {
          setError(rpcError.message || 'Đã xảy ra lỗi khi tạo workspace.')
        }
        setLoading(false)
        return
      }

      if (workspaceId) {
        router.push('/app/dashboard')
        router.refresh()
      }
    } catch {
      setError('Lỗi kết nối mạng. Vui lòng thử lại sau.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8 bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-gray-900">
            Tạo Workspace mới
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Hãy thiết lập workspace để bắt đầu quản lý CRM cho doanh nghiệp của bạn
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div>
              <label
                htmlFor="workspaceName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Tên Workspace <span className="text-red-500">*</span>
              </label>
              <input
                id="workspaceName"
                name="workspaceName"
                type="text"
                required
                value={name}
                onChange={handleNameChange}
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="Ví dụ: Công ty Cổ phần CRM"
              />
            </div>

            <div>
              <label
                htmlFor="workspaceSlug"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Slug Đường dẫn (URL Slug) <span className="text-red-500">*</span>
              </label>
              <div className="flex rounded-lg shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  app/
                </span>
                <input
                  id="workspaceSlug"
                  name="workspaceSlug"
                  type="text"
                  required
                  value={slug}
                  onChange={handleSlugChange}
                  className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-lg border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="cong-ty-crm"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Slug được đề xuất tự động từ tên workspace. Bạn có thể chỉnh sửa thủ công.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div>
                <span className="font-semibold block text-gray-700">Múi giờ:</span>
                {timezone}
              </div>
              <div>
                <span className="font-semibold block text-gray-700">Tiền tệ:</span>
                {currency}
              </div>
              <div>
                <span className="font-semibold block text-gray-700">Ngôn ngữ:</span>
                {language}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Đang khởi tạo...' : 'Tạo Workspace'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
