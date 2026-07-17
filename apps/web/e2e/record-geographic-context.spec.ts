import { expect, test } from '@playwright/test'

test('opens an inspected record in its exact Geographic Impact cell and table row', async ({
  page,
}) => {
  test.setTimeout(120_000)

  await page.goto('./#evidence-lens')
  await page.getByRole('button', { name: 'Inspect verified discovery record' }).click()
  const geography = page.locator('.geography-reference')
  await expect(
    geography.getByRole('heading', { name: 'Artifact-grounded geographic facts' }),
  ).toBeVisible({ timeout: 60_000 })
  await expect(
    geography.getByRole('img', { name: /Record geographic context mini-map/u }),
  ).toBeVisible()
  await expect(geography.getByText('Supported comparison cell').locator('..')).toContainText(
    'H3 resolution 7',
  )
  await expect(geography.getByText('Potential contribution').locator('..')).toContainText(
    'Potential coverage-gap cell',
  )
  await expect(
    geography.getByRole('heading', { name: 'Finest configured comparison supported' }),
  ).toBeVisible()

  const openImpact = geography.getByRole('link', { name: 'Open Geographic Impact' })
  const viewCell = geography.getByRole('link', { name: 'View records in this cell' })
  await expect(openImpact).toHaveAttribute(
    'href',
    '#dashboard?geo=country%3ASE&geo-cell=87088660cffffff&geo-resolution=7&geo-focus=lens',
  )
  await expect(viewCell).toHaveAttribute(
    'href',
    '#dashboard?geo=country%3ASE&geo-cell=87088660cffffff&geo-resolution=7&geo-focus=table',
  )

  await openImpact.click()
  await expect(page).toHaveURL(/#dashboard\?geo=country%3ASE&geo-cell=87088660cffffff&geo-resolution=7&geo-focus=lens$/u)
  await expect(page.getByText('Baseline and Flickr evidence mapped', { exact: true })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.locator('#geographic-impact-lens')).toBeFocused()
  await expect(
    page.locator('.selected-geography-details').getByRole('heading', {
      name: '87088660cffffff',
    }),
  ).toBeVisible()

  await page.goto(
    './#dashboard?geo=country%3ASE&geo-cell=87088660cffffff&geo-resolution=7&geo-focus=table',
  )
  await expect(page.getByText('Baseline and Flickr evidence mapped', { exact: true })).toBeVisible({
    timeout: 60_000,
  })
  const selectedRow = page.getByRole('rowheader', { name: '87088660cffffff' }).locator('..')
  await expect(selectedRow).toBeFocused()
  await expect(selectedRow.getByRole('button', { name: 'Selected 87088660cffffff' }))
    .toHaveAttribute('aria-pressed', 'true')
})
