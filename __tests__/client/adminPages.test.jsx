/** @jest-environment jsdom */
/* eslint-disable no-unused-vars */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import HostsListPage from '../../client/src/pages/HostsListPage.jsx';
import HostFormPage from '../../client/src/pages/HostFormPage.jsx';

jest.mock('../../client/src/apiClient.js', () => ({
  requestJson: jest.fn()
}));

const { requestJson } = jest.requireMock('../../client/src/apiClient.js');

describe('Admin pages', () => {
  beforeEach(() => {
    requestJson.mockReset();
  });

  it('renders hosts list returned by the API', async () => {
    requestJson.mockResolvedValueOnce([
      { id: 1, name: 'API host', url: 'http://example.test', groupName: 'Backend' }
    ]);

    render(
      <MemoryRouter>
        <HostsListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(requestJson).toHaveBeenCalledWith('/api/v1/hosts'));
    expect(await screen.findByText('API host')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add host/i })).toHaveAttribute('href', '/hosts/new');
  });

  it('renders unsafe host URLs as plain text', async () => {
    requestJson.mockResolvedValueOnce([
      { id: 2, name: 'Unsanitized', url: 'javascript:alert(1)', groupName: null }
    ]);

    render(
      <MemoryRouter>
        <HostsListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(requestJson).toHaveBeenCalledWith('/api/v1/hosts'));

    const urlCell = await screen.findByText('javascript:alert(1)');
    expect(urlCell.closest('a')).toBeNull();
  });

  it('submits a new host to the API', async () => {
    requestJson
      .mockResolvedValueOnce([]) // groups
      .mockResolvedValueOnce({ id: 2 }); // create

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/hosts/new']}>
        <Routes>
          <Route path="/hosts/new" element={<HostFormPage mode="create" />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(requestJson).toHaveBeenCalledWith('/api/v1/groups'));

    await user.type(screen.getByLabelText(/name/i), 'New Host');
    await user.type(screen.getByLabelText(/url/i), 'http://new-host.test');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(requestJson).toHaveBeenCalledTimes(2));
    const [, postArgs] = requestJson.mock.calls[1];
    expect(requestJson.mock.calls[1][0]).toBe('/api/v1/hosts');
    expect(JSON.parse(postArgs.body)).toEqual({ name: 'New Host', url: 'http://new-host.test', groupId: null });
    expect(postArgs.method).toBe('POST');
  });
});
