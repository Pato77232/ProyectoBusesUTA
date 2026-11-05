/** Puerto: create(data) devuelve la cooperativa persistida o CooperativeError de duplicado. */
class CooperativeRepository {
  async create() {
    throw new Error('CooperativeRepository.create debe implementarse.');
  }

  async listSummary() {
    throw new Error('CooperativeRepository.listSummary debe implementarse.');
  }
}
module.exports = CooperativeRepository;
