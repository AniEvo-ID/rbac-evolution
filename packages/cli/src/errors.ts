/** An expected failure with a message for the user (exit code 1). */
export class CliError extends Error {
  readonly exitCode: number

  constructor(message: string, exitCode = 1) {
    super(message)
    this.name = 'CliError'
    this.exitCode = exitCode
  }
}

/** Wrong arguments or unknown command (exit code 2). */
export class UsageError extends CliError {
  constructor(message: string) {
    super(message, 2)
    this.name = 'UsageError'
  }
}
