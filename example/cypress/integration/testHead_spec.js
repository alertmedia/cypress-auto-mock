describe('head', () => {
  const MOCK_FILENAME = "testHead";

  before(() => {
    cy.automock(MOCK_FILENAME, {
      resolveMockFunc: (request, mockArray, mock) => {
        console.log(request.method + ' ' + request.url);
        return mock;
      }
    })
  })

  it('get header', () => {
    cy.visit('/');
    cy.get('[data-test=button-test-head-with-responseBody]').click();
    cy.get('[data-text=response-header]').contains('0');
  });

  after(() => {
    cy.automockEnd();
  })
})