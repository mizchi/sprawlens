package store

// Store keeps values by key.
type Store struct {
	data map[string]string
}

func New() *Store {
	return &Store{data: map[string]string{}}
}

func (s *Store) Get(key string) string {
	return s.data[key]
}

func (s *Store) Put(key, value string) {
	s.data[key] = value
}
