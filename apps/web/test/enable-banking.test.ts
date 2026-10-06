import { describe, expect, test } from 'bun:test'
import { bankRedirectUrl } from '../src/lib/enable-banking.ts'

describe('bankRedirectUrl', () => {
  test('passes an https address through', () => {
    expect(bankRedirectUrl('https://bank.example/auth?state=abc')).toBe('https://bank.example/auth?state=abc')
  })

  test.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', 'http://bank.example/auth', '/relative/path', '//bank.example/auth', ''])(
    'rejects %p',
    (raw) => {
      expect(() => bankRedirectUrl(raw)).toThrow()
    },
  )
})
