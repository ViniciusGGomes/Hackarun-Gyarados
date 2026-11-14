export class AccountLockedError extends Error {
  constructor(message = 'Account temporarily locked') {
    super(message)
    this.name = 'AccountLockedError'
  }
}
