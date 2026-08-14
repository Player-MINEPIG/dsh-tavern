function clone(value) {
  return structuredClone(value)
}

export function createUserAdapter(store) {
  if (typeof store?.get !== 'function') throw new TypeError('User adapter requires a user store')
  return {
    resolve({ selection } = {}) {
      const userId = selection?.userId
      if (userId === null || userId === undefined) return { user: null, diagnostics: [] }
      try {
        return { user: clone(store.get(userId)), diagnostics: [] }
      } catch (error) {
        if (error?.code !== 'USER_NOT_FOUND' && !(error instanceof TypeError)) throw error
        return {
          user: null,
          diagnostics: [{
            code: error instanceof TypeError ? 'invalid-user-selection' : 'user-not-found',
            severity: 'warning',
            message: error instanceof TypeError
              ? 'Selected user id is invalid.'
              : `Selected user "${userId}" was not found.`,
            resourceId: userId,
          }],
        }
      }
    },
  }
}
