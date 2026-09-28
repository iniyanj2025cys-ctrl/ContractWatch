package com.example.contractwatch.Repository;

import com.example.contractwatch.Model.RenewalHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RenewalHistoryRepository extends JpaRepository<RenewalHistory, Long> {
    List<RenewalHistory> findByContractIdOrderByRenewedAtDesc(Long contractId);
}
