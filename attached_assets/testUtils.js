
export class TestUtils {
  static async mockFetch(response) {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response)
      })
    );
  }

  static async mockFetchError(error) {
    global.fetch = jest.fn(() =>
      Promise.reject(error)
    );
  }

  static createMockElement() {
    return {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        toggle: jest.fn()
      }
    };
  }
}
